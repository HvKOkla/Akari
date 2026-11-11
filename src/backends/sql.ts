import { Node } from '../compiler/ast';

export class SQLCompileError extends Error {
    line?: number | string;
    constructor(msg: string, node?: Node) {
        super(msg);
        this.name = 'SQLCompileError';
        this.line = node ? (node as any).line : '?';
    }
    toString() {
        return `❌ [SQL Compile Error] ${this.message} (Line ${this.line})`;
    }
}

export interface SQLContext {
    allowedTables: string[];
    allowedColumns: Record<string, string[]>;
    maxResults?: number;
}

const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function transpileToSQL(ast: Node[], context: SQLContext = { allowedTables: [], allowedColumns: {} }): string {
    let tableName: string | null = null;
    let selectCols = "*";
    let whereClauses: string[] = [];
    const maxResults = context.maxResults || 1000;

    if (context.allowedTables.length === 0) {
        throw new SQLCompileError("SQL Security: No tables are allowed. Provide a whitelist in SQLContext.", undefined);
    }

    function checkTable(table: string) {
        if (!SAFE_IDENTIFIER.test(table)) {
            throw new SQLCompileError(`SQL Security: Invalid table name '${table}'.`, undefined);
        }
        if (!context.allowedTables.includes(table)) {
            throw new SQLCompileError(`SQL Security: Table '${table}' is not allowed.`, undefined);
        }
    }

    function checkColumn(table: string, column: string) {
        if (!SAFE_IDENTIFIER.test(column)) {
            throw new SQLCompileError(`SQL Security: Invalid column name '${column}'.`, undefined);
        }
        if (context.allowedColumns[table] && !context.allowedColumns[table].includes(column) && column !== '*') {
            throw new SQLCompileError(`SQL Security: Column '${column}' on table '${table}' is not allowed.`, undefined);
        }
    }

    function walk(node: Node): string {
        if (!node) return '';

        if (node.type === 'for_in') {
            if (node.collection && node.collection.type === 'variable') {
                tableName = (node.collection as any).name;
                checkTable(tableName!);
            } else {
                throw new SQLCompileError("SQL backend: 'for ... in' must iterate over a table name (identifier).", node);
            }
            for (const stmt of node.body) walk(stmt);
            return '';
        }

        if (node.type === 'if') {
            const condition = walk(node.condition);
            if (condition) whereClauses.push(condition);
            
            for (const stmt of node.body) walk(stmt);
            if (node.else) {
                for (const stmt of node.else) walk(stmt);
            }
            return '';
        }

        if (node.type === 'return') {
            if (node.value && node.value.type === 'variable') {
                selectCols = (node.value as any).name;
                checkColumn(tableName!, selectCols);
            } else if (node.value && node.value.type === 'table_access') {
                const targetTable = (node.value as any).target.name + "s";
                const col = (node.value as any).key;
                if (!tableName) {
                    tableName = targetTable;
                    checkTable(tableName!);
                }
                checkColumn(tableName!, col);
                selectCols = `${(node.value as any).target.name}.${col}`;
            } else if (node.value) {
                throw new SQLCompileError("SQL backend: 'return' only supports a column name or table.column.", node);
            }
            return '';
        }

        if (node.type === 'function_def') {
            for (const stmt of node.body) walk(stmt);
            return '';
        }

        if (node.type === 'binary') {
            const left = walk((node as any).left);
            const right = walk((node as any).right);
            let op = (node as any).operator;

            if (!tableName && (node as any).left.type === 'table_access') {
                tableName = (node as any).left.target.name + "s";
                checkTable(tableName!);
            }

            if (op === '==') op = '=';
            if (op === '&&') op = 'AND';
            if (op === '||') op = 'OR';
            
            if (!['=', '!=', '<', '>', '<=', '>=', 'AND', 'OR', '+', '-', '*', '/', '%'].includes(op)) {
                throw new SQLCompileError(`SQL backend: operator '${(node as any).operator}' is not supported.`, node);
            }

            return `(${left} ${op} ${right})`;
        }

        if (node.type === 'unary') {
            if ((node as any).operator === '!') return `NOT (${walk((node as any).argument)})`;
            if ((node as any).operator === '-') return `-(${walk((node as any).argument)})`;
            throw new SQLCompileError(`SQL backend: unary operator '${(node as any).operator}' is not supported.`, node);
        }

        if (node.type === 'variable') {
            return (node as any).name;
        }

        if (node.type === 'table_access') {
            if ((node as any).target.type !== 'variable') {
                throw new SQLCompileError("SQL backend: only simple table.column access is supported.", node);
            }
            if (!tableName) {
                tableName = (node as any).target.name + "s";
                checkTable(tableName!);
            }
            checkColumn(tableName!, (node as any).key);
            return `${(node as any).target.name}.${(node as any).key}`;
        }

        if (node.type === 'number') return String((node as any).value);
        if (node.type === 'string') return `'${(node as any).value.replace(/'/g, "''")}'`;
        if (node.type === 'boolean') return (node as any).value ? 'TRUE' : 'FALSE';
        if (node.type === 'nothing') return 'NULL';

        throw new SQLCompileError(`SQL backend: node type '${node.type}' is not supported.`, node);
    }

    for (const stmt of ast) {
        walk(stmt);
    }

    if (!tableName) {
        throw new SQLCompileError("SQL backend: No table found in the query. Use 'for x in table_name'.", undefined);
    }

    let sql = `SELECT ${selectCols} FROM ${tableName}`;
    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` LIMIT ${maxResults};`;
    return sql;
}
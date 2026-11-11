// src/compiler/ast.ts

export interface Position {
    line: number;
    column: number;
}

// Tous les nœuds possibles de ton AST
export type Node =
    | NumberNode
    | StringNode
    | BooleanNode
    | NothingNode
    | VariableNode
    | BinaryNode
    | UnaryNode
    | AssignmentNode
    | FunctionCallNode
    | FunctionDefNode
    | IfNode
    | WhileNode
    | ForNode
    | ForInNode
    | ReturnNode
    | BreakNode
    | ContinueNode
    | TableAccessNode
    | TableLiteralNode; // <-- AJOUT ICI

export interface NumberNode extends Position { type: 'number'; value: number; }
export interface StringNode extends Position { type: 'string'; value: string; }
export interface BooleanNode { type: 'boolean'; value: boolean; }
export interface NothingNode { type: 'nothing'; }

export interface VariableNode extends Position { type: 'variable'; name: string; }

export interface BinaryNode extends Position {
    type: 'binary';
    operator: string;
    left: Node;
    right: Node;
}

export interface UnaryNode extends Position {
    type: 'unary';
    operator: string;
    argument: Node;
}

export interface AssignmentNode extends Position {
    type: 'assignment';
    name: string;
    isMut: boolean;
    isDeclaration: boolean;
    value: Node;
}

export interface FunctionCallNode extends Position {
    type: 'function_call';
    name: string;
    args: Node[];
}

export interface FunctionDefNode {
    type: 'function_def';
    name: string;
    params: string[];
    body: Node[];
}

export interface IfNode {
    type: 'if';
    condition: Node;
    body: Node[];
    else: Node[];
}

export interface WhileNode {
    type: 'while';
    condition: Node;
    body: Node[];
}

export interface ForNode {
    type: 'for';
    varName: string;
    start: Node;
    end: Node;
    body: Node[];
}

export interface ForInNode {
    type: 'for_in';
    varName: string;
    collection: Node;
    body: Node[];
}

export interface ReturnNode extends Position {
    type: 'return';
    value: Node | null;
}

export interface BreakNode extends Position { type: 'break'; }
export interface ContinueNode extends Position { type: 'continue'; }

export interface TableAccessNode extends Position {
    type: 'table_access';
    target: Node;
    key: string;
}

export interface TableLiteralNode extends Position {
    type: 'table_literal';
    entries: { key: string; value: Node }[];
}
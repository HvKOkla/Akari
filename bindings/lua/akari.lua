local akari = {}

function akari.run(code)
    local escaped_code = code:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '')
    local json_payload = string.format('{"code": "%s"}', escaped_code)
    
    
    local command = string.format(
        'curl -s -X POST -H "Content-Type: application/json" -d "%s" http://localhost:3000/run',
        json_payload
    )
    
    local handle = io.popen(command)
    local result = handle:read("*a")
    handle:close()
    
    print(result)
    return result
end

return akari
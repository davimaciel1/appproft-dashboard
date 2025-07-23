# Setup Coolify MCP Server

## 1. Clone o repositório
```bash
cd ..
git clone https://github.com/StuMason/coolify-mcp-server
cd coolify-mcp-server
```

## 2. Configure as variáveis
Crie um arquivo .env no diretório coolify-mcp-server:
```env
COOLIFY_API_TOKEN=[SEU_TOKEN_DO_ENV]
COOLIFY_BASE_URL=[SEU_BASE_URL_DO_ENV]
```

## 3. Instale e compile
```bash
npm install
npm run build
```

## 4. Configure o Claude Desktop
Adicione ao arquivo de configuração do Claude Desktop:

Windows: %APPDATA%\Claude\claude_desktop_config.json
```json
{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": ["C:\\caminho\\para\\coolify-mcp-server\\dist\\index.js"],
      "env": {
        "COOLIFY_API_TOKEN": "[SEU_TOKEN]",
        "COOLIFY_BASE_URL": "[SEU_BASE_URL]"
      }
    }
  }
}
```

## 5. Reinicie o Claude Desktop e teste
"Liste todos os recursos do Coolify"
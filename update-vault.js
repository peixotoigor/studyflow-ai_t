const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\x1b[36m%s\x1b[0m", "=== AUTOMATIZADOR DE COFRE DIGITAL (STUDYFLOW) ===");
console.log("Este script injeta o código criptografado diretamente no arquivo App.tsx.\n");
console.log("1. Gere o código no site (Editar Perfil > Cofre Digital).");
console.log("2. Copie o código gerado.");
console.log("3. Cole abaixo e aperte ENTER:\n");

rl.question('\x1b[33mCole aqui: \x1b[0m', (vaultString) => {
  if (!vaultString || vaultString.length < 10) {
    console.error("\n\x1b[31m[Erro] Código inválido ou muito curto.\x1b[0m");
    rl.close();
    return;
  }

  const appPath = path.join(__dirname, 'App.tsx');
  
  try {
    if (!fs.existsSync(appPath)) {
        console.error(`\n\x1b[31m[Erro] Arquivo App.tsx não encontrado em: ${appPath}\x1b[0m`);
        rl.close();
        return;
    }

    let content = fs.readFileSync(appPath, 'utf8');
    
    // Procura por: const VAULT_DATA = "..."; ou const VAULT_DATA = '';
    const regex = /const VAULT_DATA = (['"`])(?:(?=(\\?))\2.)*?\1;/;
    
    if (!regex.test(content)) {
        // Tenta fallback para string vazia simples se o regex complexo falhar
        const simpleRegex = /const VAULT_DATA = "";/;
        if(!simpleRegex.test(content)) {
            console.error("\n\x1b[31m[Erro] Não encontrei a variável 'VAULT_DATA' no arquivo App.tsx.\x1b[0m");
            console.error("Certifique-se que a linha 'const VAULT_DATA = \"...\"' existe.");
            rl.close();
            return;
        }
    }

    // Substitui o conteúdo
    const newContent = content.replace(regex, `const VAULT_DATA = "${vaultString.trim()}";`);
    
    fs.writeFileSync(appPath, newContent, 'utf8');
    
    console.log("\n\x1b[32m✅ SUCESSO! O arquivo App.tsx foi atualizado com segurança.\x1b[0m");
    console.log("Próximo passo: Faça o 'git commit' e 'git push' para subir para o GitHub.");
    
  } catch (err) {
    console.error("\n\x1b[31m[Erro Fatal]\x1b[0m", err.message);
  }
  
  rl.close();
});

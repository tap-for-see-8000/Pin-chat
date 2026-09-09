const fs = require('fs');
let code = fs.readFileSync('src/services/appService.ts', 'utf8');

code = code.replace(/\\\`\\\$\\{username\\}_\\\$\\{date\\}\\\`/g, '\`${username}_${date}\`');
code = code.replace(/\\\`\\\$\\{username\\}_\\\$\\{date\\}\\\`/g, '\`${username}_${date}\`'); // Just to be sure

// The exact string in the file:
code = code.replace("const id = \\`\\${username}_\\${date}\\`;", "const id = `${username}_${date}`;");
code = code.replace("const id = \\`\\${username}_\\${date}\\`;", "const id = `${username}_${date}`;"); // Second one

fs.writeFileSync('src/services/appService.ts', code);

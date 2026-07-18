const fs = require('fs');
const path = require('path');

const files = [
  'src/app/cart/page.tsx',
  'src/app/checkout/page.tsx',
  'src/app/partner/page.tsx',
  'src/app/orders/page.tsx',
  'src/app/wishlist/page.tsx',
  'src/app/creator/products/page.tsx',
  'src/app/creator/dashboard/page.tsx',
  'src/app/admin/dashboard/page.tsx'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if it already has useEffect imported
    if (!content.includes('useEffect')) {
      content = content.replace(/import { (useState[^}]*) } from "react";/, 'import { $1, useEffect } from "react";');
      if (!content.includes('useEffect') && content.includes('import { useState }')) {
        content = content.replace('import { useState }', 'import { useState, useEffect }');
      } else if (!content.includes('useEffect') && !content.includes('import { useState }')) {
         content = content.replace(/import {[^}]*} from "react";/, match => match.replace('}', ', useEffect }'));
         if(!content.includes('useEffect')) {
             content = 'import { useEffect } from "react";\n' + content;
         }
      }
    }

    const badPattern = `  if (!isAuthenticated) {\n    router.push("/login");\n    return null;\n  }`;
    const replacement = `  useEffect(() => {\n    if (!isAuthenticated) {\n      router.push("/login");\n    }\n  }, [isAuthenticated, router]);\n\n  if (!isAuthenticated) return null;`;
    
    if (content.includes(badPattern)) {
      content = content.replace(badPattern, replacement);
      fs.writeFileSync(fullPath, content);
      console.log(`Fixed ${file}`);
    } else {
        // Try regex match
        const regex = /if\s*\(!isAuthenticated\)\s*\{\s*router\.push\(['"]\/login['"]\);\s*return\s*null;\s*\}/g;
        if(regex.test(content)) {
            content = content.replace(regex, replacement);
            fs.writeFileSync(fullPath, content);
            console.log(`Fixed ${file} with regex`);
        } else {
            console.log(`Could not find pattern in ${file}`);
        }
    }
  }
});

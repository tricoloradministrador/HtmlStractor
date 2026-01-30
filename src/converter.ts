export function convertToJsx(html: string): string {
    let jsx = html;

    // 1. Reemplazar class -> className
    jsx = jsx.replace(/\sclass="/g, ' className="');
    jsx = jsx.replace(/\sclass='/g, " className='");

    // 2. Reemplazar for -> htmlFor
    jsx = jsx.replace(/\sfor="/g, ' htmlFor="');

    // 3. Cerrar etiquetas self-closing que no lo estén
    // Lista común: img, input, br, hr, link, meta
    const selfClosingTags = ['img', 'input', 'br', 'hr', 'link', 'meta'];

    selfClosingTags.forEach(tag => {
        // Busca etiquetas que no terminan en />
        // Regex simple: <tag ... > (sin / antes de >)
        // Nota: Esto es aproximado. Un parser real es mejor, pero para scraping rápido funciona.
        const regex = new RegExp(`<${tag}([^>]*)(?<!/)>`, 'gi');
        jsx = jsx.replace(regex, `<${tag}$1 />`);
    });

    // 4. Comentarios <!-- --> a {/**/}
    jsx = jsx.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

    // 5. Styles inline (style="...") -> style={{...}}
    // Esto es muy complejo de hacer perfecto con regex porque requiere parsear el contenido CSS.
    // Por ahora, para evitar errores de compilación React, podemos comentar los style inline o intentar una conversión simple.
    // Estrategia segura: Renombrar style a styleString para que el usuario lo arregle manualmente, 
    // o intentar convertirlo si es simple. Para este MVP, lo dejaremos como warning en comentario.
    jsx = jsx.replace(/\sstyle="([^"]*)"/g, (match, styleContent) => {
        return ` style={{ /* TODO: Convert CSS to Object: ${styleContent} */ }}`;
    });

    // 6. Envolver en Fragment o div padre si es necesario (el scraper suele devolver <html> completo)
    // Pero si estamos haciendo un componente, quizás queramos solo el body content?
    // Asumiremos que el usuario quiere todo el HTML tal cual.

    return jsx;
}

export function generateReactComponent(htmlContent: string): string {
    const jsxContent = convertToJsx(htmlContent);

    return `import React from 'react';
import './styles.css'; // Asegúrate de importar tus estilos globales o módulos

export default function TricolorComponent() {
  return (
    <>
${jsxContent}
    </>
  );
}
`;
}

import puppeteer from 'puppeteer';
import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { URL } from 'url';

async function downloadFile(url: string, dest: string) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        await fs.outputFile(dest, response.data);
        console.log(`✅ Descargado: ${path.basename(dest)}`);
    } catch (error: any) {
        console.log(`⚠️  Advertencia: No se pudo descargar ${url} - ${error.message}`);
    }
}

async function scrape(targetUrl: string, outputDir: string, progressCallback?: (msg: string) => void) {
    const log = (msg: string) => {
        console.log(msg);
        if (progressCallback) progressCallback(msg);
    };

    log(`🔍 Iniciando scraping de: ${targetUrl}`);

    const CSS_DIR = path.join(outputDir, 'css');
    const JS_DIR = path.join(outputDir, 'js');
    const FONTS_DIR = path.join(CSS_DIR, 'fonts');
    const IMAGES_DIR = path.join(outputDir, 'images');

    // Limpiar directorio de salida
    await fs.emptyDir(outputDir);
    await fs.ensureDir(CSS_DIR);
    await fs.ensureDir(JS_DIR);
    await fs.ensureDir(FONTS_DIR);
    await fs.ensureDir(IMAGES_DIR);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        log('📄 Página cargada. Extrayendo recursos...');

        let html = await page.content();
        let bundledCssContent = '';
        let bundledJsContent = '';

        // --- Extracción de CSS ---
        const cssLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            return links.map(link => (link as HTMLLinkElement).href).filter(href => href);
        });

        log(`📦 Encontrados ${cssLinks.length} archivos CSS.`);

        for (let i = 0; i < cssLinks.length; i++) {
            const cssUrl = cssLinks[i];

            try {
                const response = await axios.get(cssUrl, { responseType: 'text' });
                let cssContent = response.data;

                // --- Procesar Assets (Fuentes e Imágenes en CSS) ---
                const urlRegex = /url\s*\(\s*['"]?([^'"]+)(\?[^'"]*)?['"]?\s*\)/gi;
                let match;
                const replacements: { original: string, replacement: string }[] = [];

                while ((match = urlRegex.exec(cssContent)) !== null) {
                    const originalUrl = match[1];
                    const fullMatch = match[0];

                    if (originalUrl.startsWith('data:')) continue;

                    let absoluteUrl = originalUrl;
                    if (!originalUrl.startsWith('http')) {
                        absoluteUrl = new URL(originalUrl, cssUrl).href;
                    }

                    const ext = path.extname(absoluteUrl.split('?')[0]).toLowerCase();
                    const cleanFileName = path.basename(absoluteUrl.split('?')[0]);

                    if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
                        const fontFileName = `font_${i}_${Math.floor(Math.random() * 1000)}_${cleanFileName}`;
                        const fontPath = path.join(FONTS_DIR, fontFileName);
                        await downloadFile(absoluteUrl, fontPath);
                        replacements.push({
                            original: fullMatch,
                            replacement: `url('./fonts/${fontFileName}')`
                        });
                    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                        const imgFileName = `bg_${i}_${Math.floor(Math.random() * 1000)}_${cleanFileName}`;
                        const imgPath = path.join(IMAGES_DIR, imgFileName);
                        await downloadFile(absoluteUrl, imgPath);
                        replacements.push({
                            original: fullMatch,
                            replacement: `url('../images/${imgFileName}')`
                        });
                    }
                }

                for (const rep of replacements) {
                    cssContent = cssContent.replace(rep.original, rep.replacement);
                }

                bundledCssContent += `\n/* Source: ${cssUrl} */\n${cssContent}\n`;

                const escapedUrl = cssUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const linkTagRegex = new RegExp(`<link[^>]+href=["']${escapedUrl}["'][^>]*>`, 'gi');
                html = html.replace(linkTagRegex, '');

            } catch (err: any) {
                log(`❌ Error procesando CSS ${cssUrl}: ${err.message}`);
            }
        }

        // --- Extracción de Imágenes HTML ---
        const htmlImages = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img[src]'));
            return imgs.map(img => (img as HTMLImageElement).src).filter(src => src);
        });

        const uniqueHtmlImages = [...new Set(htmlImages)];
        log(`🖼️  Encontradas ${uniqueHtmlImages.length} imágenes en HTML.`);

        for (let i = 0; i < uniqueHtmlImages.length; i++) {
            const imgUrl = uniqueHtmlImages[i];
            try {
                if (imgUrl.startsWith('data:')) continue;
                const cleanFileName = path.basename(imgUrl.split('?')[0]);
                const imgFileName = `img_${i}_${cleanFileName}`;
                const imgPath = path.join(IMAGES_DIR, imgFileName);

                await downloadFile(imgUrl, imgPath);

                html = html.split(imgUrl).join(`./images/${imgFileName}`);
            } catch (err: any) {
                log(`❌ Error imagen HTML ${imgUrl}: ${err.message}`);
            }
        }

        // --- Extracción de Logos y Meta Images (NUEVO) ---
        // Buscamos: Favicons, Apple Touch Icons, OG Images, Twitter Images
        const logoData = await page.evaluate(() => {
            const data: { url: string, type: 'icon' | 'meta' }[] = [];

            // Icons
            const icons = Array.from(document.querySelectorAll('link[rel*="icon"]'));
            icons.forEach(el => {
                const href = (el as HTMLLinkElement).href;
                if (href) data.push({ url: href, type: 'icon' });
            });

            // Meta Images
            const metas = Array.from(document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]'));
            metas.forEach(el => {
                const content = el.getAttribute('content');
                // Resolve relative meta urls manually since no .href prop
                if (content) {
                    // Basic check if absolute. If relative, puppeteer context handles resolution best if we used .href, 
                    // but meta content is string. We need to resolve against document.baseURI
                    // We return raw content and resolve outside or use new URL() here inside browser context?
                    // Safer to resolve inside browser context.
                    try {
                        const absolute = new URL(content, document.baseURI).href;
                        data.push({ url: absolute, type: 'meta' });
                    } catch (e) { }
                }
            });

            return data;
        });

        log(`🌟 Encontrados ${logoData.length} logos/iconos.`);

        for (let i = 0; i < logoData.length; i++) {
            const item = logoData[i];
            try {
                if (item.url.startsWith('data:')) continue;

                const cleanFileName = path.basename(item.url.split('?')[0]);
                const niceName = item.type === 'icon' ? `favicon_${i}_${cleanFileName}` : `meta_img_${i}_${cleanFileName}`;
                const targetPath = path.join(IMAGES_DIR, niceName);

                await downloadFile(item.url, targetPath);

                // Reemplazo en HTML
                // Ojo: Para meta tags, la URL puede aparecer en `content="..."`.
                // Para link tags, en `href="..."`.
                // El scraper simple `.split().join()` funcionará si la URL es consistente.
                // Como Puppeteer nos da URL absoluta para links y nosotros resolvimos para meta,
                // debemos asegurarnos que en el string HTML `html` coincida.
                // Si en el HTML crudo estaba relativa ("/foo.png"), `split(absoluteUrl)` no va a hacer match.
                // Intentaremos reemplazar ambos casos si es posible, o confiar en que puppeteer serializa attributes a absoluto a veces.
                // Sin embargo, para `meta content` a menudo NO se normaliza.

                // Estrategia: Reemplazar la versión absoluta (si existe) y si no, intentar adivinar la relativa?
                // Mejor: Vamos a intentar reemplazar la URL absoluta. Si no funciona, asumimos que ya estaba bien o no era crítico.
                // Para scraping "perfecto" necesitariamos parsear el string `html` con regex buscando el atributo.

                html = html.split(item.url).join(`./images/${niceName}`);

            } catch (err: any) {
                log(`❌ Error procesando Logo ${item.url}: ${err.message}`);
            }
        }

        // --- Extracción de JS ---
        const jsLinks = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            return scripts.map(script => (script as HTMLScriptElement).src).filter(src => src);
        });

        log(`📦 Encontrados ${jsLinks.length} archivos JS.`);

        for (let i = 0; i < jsLinks.length; i++) {
            const jsUrl = jsLinks[i];
            try {
                const response = await axios.get(jsUrl, { responseType: 'text' });
                bundledJsContent += `\n/* Source: ${jsUrl} */\n${response.data};\n`;

                const escapedUrl = jsUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const scriptTagRegex = new RegExp(`<script[^>]+src=["']${escapedUrl}["'][^>]*>\\s*<\\/script>`, 'gi');
                html = html.replace(scriptTagRegex, '');
                const scriptTagRegex2 = new RegExp(`<script[^>]+src=["']${escapedUrl}["'][^>]*>`, 'gi');
                html = html.replace(scriptTagRegex2, '');

            } catch (err: any) {
                log(`❌ Error procesando JS ${jsUrl}: ${err.message}`);
            }
        }

        // Guardar Bundles
        if (bundledCssContent) {
            await fs.outputFile(path.join(CSS_DIR, 'bundle.css'), bundledCssContent);
            if (html.includes('</head>')) {
                html = html.replace('</head>', '<link rel="stylesheet" href="./css/bundle.css">\n</head>');
            } else {
                html += '<link rel="stylesheet" href="./css/bundle.css">';
            }
        }

        if (bundledJsContent) {
            await fs.outputFile(path.join(JS_DIR, 'bundle.js'), bundledJsContent);
            if (html.includes('</body>')) {
                html = html.replace('</body>', '<script src="./js/bundle.js"></script>\n</body>');
            } else {
                html += '<script src="./js/bundle.js"></script>';
            }
        }

        html = html.replace(/^\s*[\r\n]/gm, '');

        const htmlPath = path.join(outputDir, 'index.html');
        await fs.outputFile(htmlPath, html);
        log(`🎉 HTML final guardado.`);

    } catch (error: any) {
        log(`❌ Error crítico: ${error.message}`);
        throw error;
    } finally {
        await browser.close();
    }
}

export { scrape };

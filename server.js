const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const DIR = __dirname;
const DESKTOP_FILE = 'C:\\Users\\LapTop 13.2\\Desktop\\لوحة_متابعة_قرارات_التوطين.html';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function executeGitSync(actionTitle, callback) {
  const commitMsg = `Auto-sync platform action: ${actionTitle || 'Update'} [${new Date().toISOString()}]`;
  const cmd = `git add index.html "داشبورد_قرارات_التوطين.html" && git commit -m "${commitMsg.replace(/"/g, '\\"')}" && git push origin main`;

  exec(cmd, { cwd: DIR }, (err, stdout, stderr) => {
    if (err) {
      console.error('Git push error:', err.message, stderr);
      callback(false, err.message);
    } else {
      console.log('Git push success:\n', stdout);
      callback(true, stdout);
    }
  });
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Status
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'online',
      platform: 'لوحة متابعة قرارات التوطين والتوظيف',
      repo: 'elgendy4433-cloud/saudization-dashboard',
      branch: 'main',
      time: new Date().toISOString()
    }));
    return;
  }

  // API: Sync to GitHub
  if (req.url === '/api/sync-github' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const actionTitle = payload.title || payload.action || 'تحديث البيانات في المنصة';

        // If updated data is sent, sync to files
        const mainHtmlPath = path.join(DIR, 'داشبورد_قرارات_التوطين.html');
        const indexHtmlPath = path.join(DIR, 'index.html');
        const distHtmlPath = path.join(DIR, 'dist', 'index.html');

        let currentHtml = fs.readFileSync(mainHtmlPath, 'utf8');

        if (payload.data && Array.isArray(payload.data)) {
          currentHtml = currentHtml.replace(
            /const DATA = \[[\s\S]*?\];/,
            `const DATA = ${JSON.stringify(payload.data, null, 2)};`
          );
        }

        fs.writeFileSync(mainHtmlPath, currentHtml, 'utf8');
        fs.writeFileSync(indexHtmlPath, currentHtml, 'utf8');
        if (fs.existsSync(path.dirname(distHtmlPath))) {
          fs.writeFileSync(distHtmlPath, currentHtml, 'utf8');
        }
        try {
          fs.writeFileSync(DESKTOP_FILE, currentHtml, 'utf8');
        } catch(e) {}

        // Execute Git commit and push to GitHub
        executeGitSync(actionTitle, (success, resultMsg) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success,
            message: success ? 'تم حفظ التحديث ورفعه مباشرة على GitHub و Cloudflare بنجاح!' : 'فشل الرفع على GitHub',
            details: resultMsg,
            time: new Date().toISOString()
          }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Serve static files
  let requestedUrl = req.url.split('?')[0];
  if (requestedUrl === '/' || requestedUrl === '') {
    requestedUrl = '/داشبورد_قرارات_التوطين.html';
  }

  let safePath = decodeURIComponent(requestedUrl);
  let filePath = path.join(DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIR, 'داشبورد_قرارات_التوطين.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error loading dashboard');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER_READY:http://localhost:${PORT}`);
});

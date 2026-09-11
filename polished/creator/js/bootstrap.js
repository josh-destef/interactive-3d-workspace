// Keep startup failures readable, including unavailable CDN modules or WebGL.
import('./main.js').catch(error => {
  console.error('Creation Studio startup failed', error);
  const loading = document.getElementById('loading');
  loading.hidden = false;
  loading.textContent = 'The 3D workspace could not start. Check your connection and that WebGL is enabled, then reload this page.';
  document.getElementById('status').textContent = 'Workspace unavailable';
});

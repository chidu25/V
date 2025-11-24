const form = document.getElementById('render-form');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('image');
const statusPill = document.getElementById('status-pill');
const progressNote = document.getElementById('progress-note');
const result = document.getElementById('result');
const preview = document.getElementById('preview');
const download = document.getElementById('download');
const reset = document.getElementById('reset');

const setStatus = (label, tone = 'muted') => {
  statusPill.textContent = label;
  statusPill.style.color = tone === 'good' ? '#8be28e' : tone === 'warn' ? '#f6c344' : '#c6c6d4';
  statusPill.style.borderColor = '#211c10';
};

const setLoading = isLoading => {
  form.querySelectorAll('input, select, button').forEach(el => el.disabled = isLoading);
  setStatus(isLoading ? 'Rendering...' : 'Idle', isLoading ? 'warn' : 'muted');
  progressNote.textContent = isLoading ? 'Rendering with FFmpeg. This can take a few seconds…' : 'Secure upload. Rendering happens on the server.';
};

dropzone.addEventListener('click', () => fileInput.click());
['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault();
  dropzone.classList.add('active');
}));
['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault();
  dropzone.classList.remove('active');
}));
dropzone.addEventListener('drop', e => {
  const [file] = e.dataTransfer.files;
  if (file && file.type.startsWith('image/')) {
    fileInput.files = e.dataTransfer.files;
    setStatus('Image queued', 'good');
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!fileInput.files.length) {
    setStatus('Select an image first', 'warn');
    return;
  }

  const formData = new FormData(form);
  setLoading(true);
  result.hidden = true;
  try {
    const response = await fetch('/api/render', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unable to render' }));
      throw new Error(error.error || 'Render failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    preview.src = url;
    preview.load();
    download.href = url;
    result.hidden = false;
    setStatus('Render complete', 'good');
    progressNote.textContent = 'Preview and download your MP4.';
    window.scrollTo({ top: result.offsetTop - 80, behavior: 'smooth' });
  } catch (error) {
    console.error(error);
    alert(error.message || 'Unable to render your video.');
    setStatus('Something went wrong', 'warn');
    progressNote.textContent = 'Try again with a different image or smaller file size.';
  } finally {
    setLoading(false);
  }
});

reset.addEventListener('click', () => {
  form.reset();
  result.hidden = true;
  setStatus('Idle');
  progressNote.textContent = 'Secure upload. Rendering happens on the server.';
});

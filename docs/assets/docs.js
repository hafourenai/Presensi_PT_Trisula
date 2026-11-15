document.querySelectorAll('pre').forEach((pre) => {
  const button = document.createElement('button');
  button.className = 'copy';
  button.textContent = 'SALIN';
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(pre.querySelector('code')?.innerText || pre.innerText);
    button.textContent = 'TERSALIN';
    setTimeout(() => (button.textContent = 'SALIN'), 1400);
  });
  pre.appendChild(button);
});

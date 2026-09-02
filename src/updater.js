// Rempaint Auto-Updater Engine (Tauri v2)

let sessionDismissed = false;
let isChecking = false;
let isDownloading = false;
let activeUpdate = null;
let autoDismissTimer = null;

/**
 * Resolves the Tauri v2 Updater API across global and module environments.
 */
async function getUpdaterApi() {
  if (window.__TAURI__?.updater?.check) {
    return window.__TAURI__.updater;
  }
  try {
    const mod = await import('@tauri-apps/plugin-updater');
    if (mod && typeof mod.check === 'function') {
      return mod;
    }
  } catch (e) {
    // Non-fatal if running in browser dev environment
  }
  return null;
}

/**
 * Resolves the Tauri v2 Process API across global and module environments.
 */
async function getProcessApi() {
  if (window.__TAURI__?.process?.relaunch) {
    return window.__TAURI__.process;
  }
  try {
    const mod = await import('@tauri-apps/plugin-process');
    if (mod && typeof mod.relaunch === 'function') {
      return mod;
    }
  } catch (e) {
    // Non-fatal if running in browser dev environment
  }
  return null;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

/**
 * Initializes the in-app updater system.
 */
export function initAutoUpdater() {
  const toast = document.getElementById('update-toast');
  if (!toast) return;

  const badgeVersion = document.getElementById('update-badge-version');
  const toastTitle = document.getElementById('update-toast-title-text');
  const toastBody = document.getElementById('update-toast-body');
  const progressContainer = document.getElementById('update-progress-container');
  const progressBar = document.getElementById('update-progress-bar');
  const progressText = document.getElementById('update-progress-text');
  const actionsContainer = document.getElementById('update-toast-actions');
  const btnUpdateNow = document.getElementById('btn-update-now');
  const btnUpdateLater = document.getElementById('btn-update-later');
  const btnClose = document.getElementById('btn-update-close');

  function clearAutoDismiss() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
  }

  function hideToast() {
    clearAutoDismiss();
    toast.classList.add('hidden');
  }

  function showToast() {
    clearAutoDismiss();
    toast.classList.remove('hidden');
  }

  // Dismiss for session only (never re-nag mid-session)
  if (btnUpdateLater) {
    btnUpdateLater.addEventListener('click', () => {
      sessionDismissed = true;
      hideToast();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (!isDownloading) {
        sessionDismissed = true;
        hideToast();
      }
    });
  }

  // Update Now action with real byte progress tracking
  if (btnUpdateNow) {
    btnUpdateNow.addEventListener('click', async () => {
      if (!activeUpdate || isDownloading) return;

      const processApi = await getProcessApi();
      isDownloading = true;

      // Lock UI into download state
      actionsContainer.classList.add('hidden');
      progressContainer.classList.remove('hidden');
      progressBar.style.width = '0%';
      progressText.textContent = 'Connecting to download server...';
      if (btnClose) btnClose.style.display = 'none';

      let totalBytes = 0;
      let downloadedBytes = 0;

      try {
        await activeUpdate.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started': {
              totalBytes = event.data?.contentLength || 0;
              downloadedBytes = 0;
              progressBar.style.width = '0%';
              progressText.textContent = totalBytes > 0
                ? `Starting download (${formatBytes(totalBytes)})...`
                : 'Starting download...';
              break;
            }
            case 'Progress': {
              const chunk = event.data?.chunkLength || 0;
              downloadedBytes += chunk;

              if (totalBytes > 0) {
                const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `Downloading: ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`;
              } else {
                progressBar.style.width = '50%';
                progressText.textContent = `Downloading: ${formatBytes(downloadedBytes)}...`;
              }
              break;
            }
            case 'Finished': {
              progressBar.style.width = '100%';
              progressText.textContent = 'Download complete. Installing update...';
              break;
            }
          }
        });

        progressText.textContent = 'Update installed! Restarting Rempaint...';

        // Give the user a brief moment to see success, then relaunch
        setTimeout(async () => {
          try {
            if (processApi && typeof processApi.relaunch === 'function') {
              await processApi.relaunch();
            } else if (window.__TAURI__?.core?.invoke) {
              await window.__TAURI__.core.invoke('plugin:process|restart');
            }
          } catch (relaunchErr) {
            console.error('Relaunch failed:', relaunchErr);
            progressText.textContent = 'Update installed! Please restart Rempaint.';
          }
        }, 800);

      } catch (err) {
        console.error('Update download/install error:', err);
        isDownloading = false;
        progressContainer.classList.add('hidden');
        actionsContainer.classList.remove('hidden');
        if (btnClose) btnClose.style.display = '';

        toastBody.textContent = `Failed to install update: ${err?.message || err}`;
        btnUpdateNow.textContent = 'Retry Update';
      }
    });
  }

  /**
   * Internal routine for update checks.
   * @param {boolean} isManual - true if invoked by user via Help menu
   */
  async function performCheck(isManual = false) {
    if (isChecking || isDownloading) return;

    // In manual mode, reset session dismissal
    if (isManual) {
      sessionDismissed = false;
    } else if (sessionDismissed) {
      return;
    }

    const updaterApi = await getUpdaterApi();

    if (!updaterApi) {
      if (isManual) {
        // Inform user in browser environment
        badgeVersion.textContent = '';
        toastTitle.textContent = 'Updates';
        toastBody.textContent = 'Update checks are available in the desktop application.';
        progressContainer.classList.add('hidden');
        actionsContainer.classList.add('hidden');
        showToast();
        autoDismissTimer = setTimeout(hideToast, 4000);
      }
      return;
    }

    isChecking = true;

    if (isManual) {
      badgeVersion.textContent = '';
      toastTitle.textContent = 'Checking for Updates';
      toastBody.textContent = 'Contacting GitHub releases...';
      progressContainer.classList.add('hidden');
      actionsContainer.classList.add('hidden');
      showToast();
    }

    try {
      const update = await updaterApi.check();
      isChecking = false;

      if (update && (update.available !== false) && update.version) {
        activeUpdate = update;

        badgeVersion.textContent = `v${update.version}`;
        toastTitle.textContent = 'Update Available';

        let notes = update.body ? update.body.trim() : '';
        if (!notes) {
          notes = `Version ${update.version} is now available. Would you like to update now?`;
        }
        toastBody.textContent = notes;

        progressContainer.classList.add('hidden');
        actionsContainer.classList.remove('hidden');
        btnUpdateNow.textContent = 'Update now';
        btnUpdateLater.textContent = 'Remind me later';
        if (btnClose) btnClose.style.display = '';

        showToast();
      } else {
        activeUpdate = null;
        if (isManual) {
          badgeVersion.textContent = '';
          toastTitle.textContent = 'Up to Date';
          toastBody.textContent = 'Rempaint is already on the latest version.';
          progressContainer.classList.add('hidden');
          actionsContainer.classList.add('hidden');
          showToast();
          autoDismissTimer = setTimeout(hideToast, 4000);
        } else {
          hideToast();
        }
      }
    } catch (err) {
      isChecking = false;
      console.warn('Update check failed:', err);

      if (isManual) {
        badgeVersion.textContent = '';
        const errMsg = String(err?.message || err);
        if (errMsg.includes('release JSON') || errMsg.includes('404')) {
          toastTitle.textContent = 'No Remote Releases Yet';
          toastBody.textContent = 'No published releases were found on GitHub yet. Once you publish your first release tag (e.g. v0.1.1), updates will be discovered here.';
        } else {
          toastTitle.textContent = 'Update Check Failed';
          toastBody.textContent = `Could not check for updates: ${errMsg}`;
        }
        progressContainer.classList.add('hidden');
        actionsContainer.classList.add('hidden');
        showToast();
        autoDismissTimer = setTimeout(hideToast, 6000);
      }
    }
  }

  // 1. Silent, passive background check on startup (never auto-downloads)
  setTimeout(() => {
    performCheck(false);
  }, 2000);

  function simulateUpdate(mockVersion = '0.2.0', mockNotes = '• Added copy/paste support (Ctrl+C, Ctrl+V)\n• Fixed filled shape selection\n• Improved rendering performance') {
    sessionDismissed = false;
    isDownloading = false;
    isChecking = false;

    activeUpdate = {
      version: mockVersion,
      body: mockNotes,
      downloadAndInstall: async (callback) => {
        const total = 14857600; // ~14.2 MB
        callback({ event: 'Started', data: { contentLength: total } });
        const chunkSize = 1485760;
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 250));
          callback({ event: 'Progress', data: { chunkLength: chunkSize } });
        }
        callback({ event: 'Finished' });
      },
    };

    badgeVersion.textContent = `v${mockVersion}`;
    toastTitle.textContent = 'Update Available (Simulation)';
    toastBody.textContent = mockNotes;
    progressContainer.classList.add('hidden');
    actionsContainer.classList.remove('hidden');
    btnUpdateNow.textContent = 'Update now';
    btnUpdateLater.textContent = 'Remind me later';
    if (btnClose) btnClose.style.display = '';
    showToast();
    console.log(`[Rempaint] Simulating update v${mockVersion}`);
    return `Simulating update v${mockVersion}`;
  }

  window.__simulateUpdate = simulateUpdate;

  // 3. Export manual check trigger and simulation for Help menu
  return {
    checkForUpdates: () => performCheck(true),
    simulateUpdate,
  };
}

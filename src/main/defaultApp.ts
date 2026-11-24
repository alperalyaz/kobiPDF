import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { app, ipcMain, shell } from 'electron'
import { IpcChannels, type DefaultPdfStatus } from '../shared/ipc'

/** Package identity name from Partner Center (electron-builder.yml, appx.identityName). */
const STORE_IDENTITY = 'Hidroteknik.kobiPDF'

function regQuery(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('reg', ['query', ...args], { windowsHide: true, timeout: 5000 }, (err, stdout) =>
      resolve(err ? null : stdout)
    )
  })
}

/** Reads one REG_SZ / REG_EXPAND_SZ value out of `reg query` output. */
function regValue(output: string | null): string | null {
  const match = output?.match(/REG_(?:EXPAND_)?SZ\s+(.*)/)
  return match ? match[1].trim() : null
}

/**
 * Whether double-clicking a PDF opens this copy of kobiPDF. Windows keeps the
 * user's choice under UserChoice; the ProgId it names points at the command
 * that runs, which we compare with our own executable.
 */
async function defaultPdfStatus(): Promise<DefaultPdfStatus> {
  // Only an installed build is registered with Windows; the dev build is plain electron.exe.
  if (process.platform !== 'win32' || !app.isPackaged) return 'unsupported'
  const choice = regValue(
    await regQuery(['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\UserChoice', '/v', 'ProgId'])
  )
  const progId = choice ?? regValue(await regQuery(['HKCR\\.pdf', '/ve']))
  if (!progId) return 'notDefault'
  // Store (MSIX) installs register an AppX ProgId with no command line; it names the app by its AppUserModelID.
  const appModelId = regValue(await regQuery([`HKCR\\${progId}\\Application`, '/v', 'AppUserModelID']))
  if (appModelId) return appModelId.startsWith(`${STORE_IDENTITY}_`) ? 'default' : 'notDefault'
  const command = regValue(await regQuery([`HKCR\\${progId}\\shell\\open\\command`, '/ve']))
  if (!command) return 'notDefault'
  const exe = basename(process.execPath).toLowerCase()
  const lower = command.toLowerCase()
  return lower.includes(process.execPath.toLowerCase()) || lower.includes(`\\${exe}`) ? 'default' : 'notDefault'
}

export function registerDefaultAppHandlers(): void {
  ipcMain.handle(IpcChannels.appDefaultPdfStatus, () => defaultPdfStatus())
  // Windows does not let apps make themselves the default; the user picks kobiPDF in Settings.
  ipcMain.handle(IpcChannels.appOpenDefaultApps, () => shell.openExternal('ms-settings:defaultapps'))
}

import {watch} from 'chokidar';
import {existsSync} from 'fs';
import {copy, remove} from 'fs-extra';
import {join} from 'path';
import {Observable} from 'rxjs';
import {debounceTime, filter, tap} from 'rxjs/operators';
import {restartStaticServer, startScullyWatchMode} from '../scully';
import {green, log, logWarn, red} from '../utils/log';
import {scullyConfig} from './config';
import {createFolderFor} from './createFolderFor';


export async function checkChangeAngular(
  folder = join(scullyConfig.homeFolder, scullyConfig.distFolder) ||
    join(scullyConfig.homeFolder, './dist/browser'),
  reset = true,
  // tslint:disable-next-line:no-shadowed-variable
  watch = false
) {
  reWatch(folder, reset, watch);
}

// tslint:disable-next-line:no-shadowed-variable
function reWatch(folder, reset = true, watch = false) {
  const filename = join(folder);
  // watching 1 folder level above.
  watchFolder(join(folder, '../'))
    .pipe(
      // TODO test on mac, figure out what's coming in.
      // only act upon changes of the actual folder i'm intrested in.
      filter(r => r.fileName.includes(filename)),
      // tap(r => log(`debug only: filename:"${yellow(filename)}" changedName:"${yellow(r.fileName)}"`)),
      /** give the CLI some time to finnish */
      debounceTime(1000),
      // tap(console.log),
      tap(() => moveDistAngular(folder, scullyConfig.outFolder, {reset}, watch))
      // take(2)
    )
    .subscribe({
      complete: async () => {
        // await moveDistAngular(folder, scullyConfig.outFolder);
      },
    });
}

function watchFolder(folder): Observable<{eventType: string; fileName: string}> {
  return new Observable(obs => {
    let watcher;
    try {
      watcher = watch(folder).on('all', (eventType, fileName) => {
        obs.next({eventType, fileName});
      });
    } catch (e) {
      obs.error(e);
    }
    return () => watcher.close();
  });
}

export function existDistAngular(src) {
  try {
    if (!existsSync(src)) {
      log(`${red(`Build not found`)}.`);
      log(`Please build first your angular app`);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// tslint:disable-next-line:no-shadowed-variable
export async function moveDistAngular(src, dest, {reset = true, removeStaticDist = false}, watch = false) {
  try {
    // delete files
    if (removeStaticDist) {
      logWarn(`Cleaned up ${dest} folder.`);
      await remove(dest);
    }
    // make sure the static folder exists
    createFolderFor(dest);
    await copy(src, dest);
    log(`${green(` ☺  `)} new Angular build imported`);
    if (reset) {
      restartStaticServer();
    } else if (watch) {
      startScullyWatchMode();
    }
  } catch (e) {
    /**
     * Ignore errors.
     * Those are probably cause by too fast iterations
     * TODO: make sure this is solid
     */
  }
}

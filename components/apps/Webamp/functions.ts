import type {
  ButterChurnPresets,
  ButterChurnWebampPreset,
  WebampCI,
} from "components/apps/Webamp/types";
import { centerPosition } from "components/system/Window/functions";
import type { Position } from "react-rnd";
import { HOME, MP3_MIME_TYPE } from "utils/constants";
import { bufferToBlob, cleanUpBufferUrl, loadFiles } from "utils/functions";
import type { Track, URLTrack } from "webamp";

const WEBAMP_SKINS_PATH = `${HOME}/Documents/Winamp Skins`;

export const BASE_WEBAMP_OPTIONS = {
  availableSkins: [
    {
      name: "Aqua X",
      url: `${WEBAMP_SKINS_PATH}/Aqua_X.wsz`,
    },
    {
      name: "Nucleo NLog v2G",
      url: `${WEBAMP_SKINS_PATH}/Nucleo_NLog_v102.wsz`,
    },
    {
      name: "SpyAMP Professional Edition v5",
      url: `${WEBAMP_SKINS_PATH}/SpyAMP_Professional_Edition_v5.wsz`,
    },
  ],
};

const BASE_WINDOW_SIZE = {
  height: 116,
  width: 275,
};

const CONTAINER_WINDOW = "#webamp";

export const MAIN_WINDOW = "#main-window";

export const PLAYLIST_WINDOW = "#playlist-window";

export const cleanBufferOnSkinLoad = (
  webamp: WebampCI,
  url = ""
): Promise<void> =>
  webamp.skinIsLoaded().then(() => {
    if (url) cleanUpBufferUrl(url);
  });

export const closeEqualizer = (webamp: WebampCI): void =>
  webamp.store.dispatch({
    type: "CLOSE_WINDOW",
    windowId: "equalizer",
  });

export const enabledMilkdrop = (webamp: WebampCI): void =>
  webamp.store.dispatch({
    open: false,
    type: "ENABLE_MILKDROP",
  });

export const loadButterchurn = (webamp: WebampCI, butterchurn: unknown): void =>
  webamp.store.dispatch({
    butterchurn,
    type: "GOT_BUTTERCHURN",
  });

export const loadButterchurnPresets = (
  webamp: WebampCI,
  presets: ButterChurnWebampPreset[]
): void =>
  webamp.store.dispatch({
    presets,
    type: "GOT_BUTTERCHURN_PRESETS",
  });

export const loadButterchurnPreset = (webamp: WebampCI): void => {
  const { presets = [] } = webamp.store.getState()?.milkdrop || {};
  const index = Math.floor(Math.random() * presets.length);
  const preset = presets[index];

  if (preset) {
    webamp.store.dispatch({
      addToHistory: true,
      index,
      type: "PRESET_REQUESTED",
    });
    webamp.store.dispatch({
      index,
      type: "SELECT_PRESET_AT_INDEX",
    });
  }
};

let cycleTimerId = 0;

const cycleButterchurnPresets = (webamp: WebampCI): void => {
  window.clearInterval(cycleTimerId);
  cycleTimerId = window.setInterval(() => {
    if (!webamp) window.clearInterval(cycleTimerId);

    loadButterchurnPreset(webamp);
  }, 20000);
};

export const loadMilkdropWhenNeeded = (webamp: WebampCI): void => {
  const unsubscribe = webamp.store.subscribe(() => {
    const { milkdrop, windows } = webamp.store.getState();

    if (windows?.genWindows?.milkdrop?.open && !milkdrop?.butterchurn) {
      loadFiles(["/Program Files/Webamp/butterchurn.min.js"]).then(() => {
        if (!window.butterchurn?.default) return;

        loadButterchurn(webamp, window.butterchurn.default);
        unsubscribe();

        webamp.store.subscribe(() => {
          const webampDesktop = [...document.body.children].find((node) =>
            node.classList?.contains("webamp-desktop")
          );

          if (webampDesktop) {
            const main = document.querySelector("main");

            if (main) {
              [...main.children].forEach((node) => {
                if (node.classList?.contains("webamp-desktop")) {
                  node.remove();
                }
              });
              main.appendChild(webampDesktop);
            }
          }
        });

        import("butterchurn-presets").then(({ default: presets }) => {
          const resolvedPresets: ButterChurnWebampPreset[] = Object.entries(
            presets as ButterChurnPresets
          ).map(([name, preset]) => ({
            name,
            preset,
          }));

          loadButterchurnPresets(webamp, resolvedPresets);
          loadButterchurnPreset(webamp);
          cycleButterchurnPresets(webamp);
        });
      });
    }
  });
};

export const getWebampElement = (): HTMLDivElement | null =>
  document.querySelector<HTMLDivElement>(CONTAINER_WINDOW);

export const updateWebampPosition = (
  webamp: WebampCI,
  taskbarHeight: string,
  position?: Position
): void => {
  const { height, width } = BASE_WINDOW_SIZE;
  const { x, y } =
    position || centerPosition({ height: height * 2, width }, taskbarHeight);

  webamp.store.dispatch({
    positions: {
      main: { x, y },
      milkdrop: { x, y: height * 2 + y },
      playlist: { x, y: height + y },
    },
    type: "UPDATE_WINDOW_POSITIONS",
  });
};

export const focusWindow = (webamp: WebampCI, window: string): void =>
  webamp.store.dispatch({
    type: "SET_FOCUSED_WINDOW",
    window,
  });

export const unFocus = (webamp: WebampCI): void =>
  webamp.store.dispatch({
    type: "SET_FOCUSED_WINDOW",
    window: "",
  });

export const parseTrack = async (
  file: Buffer,
  fileName: string
): Promise<Track> => {
  const { parseBuffer } = await import("music-metadata-browser");
  const {
    common: { album = "", artist = "", title = fileName },
    format: { duration = 0 },
  } = await parseBuffer(
    file,
    {
      mimeType: MP3_MIME_TYPE,
      size: file.length,
    },
    { duration: true, skipCovers: true, skipPostHeaders: true }
  );

  return {
    blob: bufferToBlob(file, "audio/mpeg"),
    duration: Math.floor(duration),
    metaData: { album, artist, title },
  };
};

export const createM3uPlaylist = (tracks: URLTrack[]): string => {
  const m3uPlaylist = tracks.map((track): string => {
    const trackUrl = track.url ? `\n${track.url.toString()}` : "";
    let title = track.defaultName;

    if (track.metaData?.artist) {
      if (track.metaData?.title) {
        title = `${track.metaData.artist} - ${track.metaData.title}`;
      } else if (title) {
        title = `${track.metaData.artist} - ${title}`;
      }
    } else if (track.metaData?.title) {
      title = track.metaData.title;
    }

    return trackUrl
      ? `#EXTINF:${track.duration ?? -1},${title || ""}${trackUrl}`
      : "";
  });

  return `${["#EXTM3U", ...m3uPlaylist.filter(Boolean)].join("\n")}\n`;
};

export const tracksFromPlaylist = async (
  data: string,
  extension: string,
  defaultName?: string
): Promise<Track[]> => {
  const { ASX, M3U, PLS } = await import("playlist-parser");
  const parser: Record<string, typeof ASX | typeof M3U | typeof PLS> = {
    ".asx": ASX,
    ".m3u": M3U,
    ".pls": PLS,
  };
  const tracks = parser[extension]?.parse(data) ?? [];

  return tracks.map(({ artist = "", file, length = 0, title = "" }) => {
    const [parsedArtist, parsedTitle] = [artist.trim(), title.trim()];

    return {
      duration: length > 0 ? length : 0,
      metaData: {
        album: parsedTitle || defaultName,
        artist: parsedArtist,
        title: parsedTitle,
      },
      url: file,
    };
  });
};

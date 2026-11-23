// What the member's computer is missing, as plain lines with the fix for Mac and Windows.
export function missingTools({ nodeVersion, has, whisperFound, voice }) {
  const out = [];
  if (Number(/^v?(\d+)/.exec(nodeVersion)?.[1] ?? 0) < 22)
    out.push(`Node 22 or newer is needed (this computer has ${nodeVersion}). Mac: brew install node   Windows: winget install OpenJS.NodeJS.LTS`);
  if (!has("ffmpeg"))
    out.push("ffmpeg is missing. Mac: brew install ffmpeg   Windows: winget install Gyan.FFmpeg, then close and reopen the terminal");
  if (voice && !whisperFound)
    out.push("whisper-cpp is missing (it times the words of the voice). Mac: brew install whisper-cpp   Windows: download " +
      "`whisper-bin-x64.zip` from https://github.com/ggml-org/whisper.cpp/releases, unzip it, and set " +
      "`HYPERFRAMES_WHISPER_PATH` to the `whisper-cli.exe` inside (`setx HYPERFRAMES_WHISPER_PATH \"C:\\path\\to\\whisper-cli.exe\"`, " +
      "then reopen the terminal). Without it the captions step tries to build Whisper and needs developer tools.");
  return out;
}

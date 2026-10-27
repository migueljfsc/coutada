/** Hands the browser a file to save, made from text. */
export const download = (fileName: string, type: string, text: string) => save(fileName, new Blob([text], { type }));

/** Hands the browser a file to save. */
export function save(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A name a file system takes: the map's name in plain letters, digits and dashes. */
export const fileStem = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "coutada";

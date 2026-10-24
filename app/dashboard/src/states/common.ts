import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const themeAtom = atomWithStorage<"light" | "dark">("theme", "light");

export const expandedSidebarAtom = atomWithStorage("expandedSidebar", true);

export const titleAtom = atom("");

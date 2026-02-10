import { atom } from 'nanostores';

/** Holds the current search text */
export const searchQuery = atom<string>('');

/** Holds a trigger for the "Random" button */
export const randomTrigger = atom<number>(0);

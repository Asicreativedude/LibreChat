import { atom } from 'recoil';

// Improved helper function to create atoms with localStorage
export function atomWithLocalStorage<T>(key: string, defaultValue: T | (() => T)) {
  // A function default is a lazy initializer (like React's useState). Ceiling: no atom may
  // store a function *value* — its factory would be run instead of stored.
  const resolveDefault = () =>
    typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
  return atom<T>({
    key,
    default: resolveDefault(),
    effects_UNSTABLE: [
      ({ setSelf, onSet }) => {
        const savedValue = localStorage.getItem(key);
        if (savedValue !== null) {
          try {
            const parsedValue = JSON.parse(savedValue);
            setSelf(parsedValue);
          } catch (e) {
            console.error(
              `Error parsing localStorage key "${key}", \`savedValue\`: defaultValue, error:`,
              e,
            );
            localStorage.setItem(key, JSON.stringify(resolveDefault()));
            setSelf(resolveDefault());
          }
        } else if (typeof defaultValue === 'function') {
          // Lazy default: resolve at subscribe time (e.g. after i18n set <html dir>),
          // not module-load, and don't persist until the user actually changes it.
          setSelf(resolveDefault());
        }

        onSet((newValue: T) => {
          localStorage.setItem(key, JSON.stringify(newValue));
        });
      },
    ],
  });
}

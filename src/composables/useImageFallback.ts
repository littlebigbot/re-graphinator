import { ref } from 'vue';

export function useImageFallback() {
  const broken = ref(new Set<number>());

  function onError(id: number): void {
    broken.value = new Set(broken.value).add(id);
  }

  function isBroken(id: number): boolean {
    return broken.value.has(id);
  }

  return { broken, onError, isBroken };
}

declare module "dragula" {
  interface DragulaOptions {
    isContainer?: (el?: HTMLElement) => boolean;
    moves?: (el?: HTMLElement, source?: HTMLElement, handle?: HTMLElement, sibling?: HTMLElement) => boolean;
    accepts?: (el?: HTMLElement, target?: HTMLElement, source?: HTMLElement, sibling?: HTMLElement) => boolean;
    invalid?: (el?: HTMLElement, handle?: HTMLElement) => boolean;
    direction?: string;
    copy?: boolean | ((el: HTMLElement, source: HTMLElement) => boolean);
    copySortSource?: boolean;
    revertOnSpill?: boolean;
    removeOnSpill?: boolean;
    mirrorContainer?: HTMLElement;
    ignoreInputTextSelection?: boolean;
    slideFactorX?: number;
    slideFactorY?: number;
    containers?: HTMLElement[];
  }

  interface Drake {
    containers: HTMLElement[];
    dragging: boolean;
    start(item: HTMLElement): void;
    end(): void;
    cancel(revert?: boolean): void;
    remove(): void;
    on(event: string, listener: (...args: unknown[]) => void): Drake;
    canMove(item: HTMLElement): boolean;
    destroy(): void;
  }

  function dragula(containers?: HTMLElement[], options?: DragulaOptions): Drake;
  function dragula(options?: DragulaOptions): Drake;

  export default dragula;
}

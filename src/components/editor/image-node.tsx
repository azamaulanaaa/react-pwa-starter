/**
 * Image node for the Markdown editor.
 *
 * The node stores a `/fs/{id}` source and loads the blob through the worker.
 * The Markdown form is `![alt](/fs/{id})`.
 */

import {
  Component,
  createContext,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";

import { useTranslation } from "@/components/context/translation.tsx";
import { useFileBlob } from "@/hooks/engines/use-file-blob.ts";

/** Matches a file path and captures the identifier. */
const FILE_PATH = /^\/fs\/([A-Za-z0-9_-]+)$/;

/** Loads one image file for a file id. */
export type ImageResolver = (fileId: string) => Promise<Blob | null>;

/**
 * Carries an optional image resolver through the editor.
 * A story can supply a resolver when no worker is present.
 */
export const ImageResolverContext = createContext<ImageResolver | undefined>(
  undefined,
);

/** Defines the values that create one image node. */
export interface ImageNodeParams {
  /** The image source. The value is `/fs/{id}`. */
  src: string;
  /** The alternative text. The value is not empty. */
  alt: string;
  /** The image title. The value can be empty. */
  title: string;
}

/** Defines the JSON form of one image node. */
export type SerializedImageNode = SerializedLexicalNode & {
  src: string;
  alt: string;
  title: string;
};

/** Reads the file id from one image source. */
function readFileId(src: string): string | null {
  const match = FILE_PATH.exec(src);
  return match === null ? null : match[1];
}

/** Shows the alt text and the unavailable state for an image. */
function ImageUnavailable({ alt }: { alt: string }): ReactElement {
  const { t } = useTranslation();

  return (
    <span className="md-image-fallback" data-state="unavailable">
      {alt === "" ? null : <span className="md-image-alt">{alt}</span>}
      <span className="md-image-message">{t("editor_image_unavailable")}</span>
    </span>
  );
}

/** Loads one file and shows the image, the loading state, or the fallback. */
function ImageContent({
  alt,
  fileId,
  resolveFile,
  title,
}: {
  alt: string;
  fileId: string | null;
  resolveFile?: ImageResolver;
  title: string;
}): ReactElement {
  const state = useFileBlob(fileId, resolveFile);

  if (fileId !== null && state.status === "ready") {
    return (
      <img
        alt={alt}
        className="image-node-image"
        decoding="async"
        loading="lazy"
        src={state.url}
        title={title}
      />
    );
  }

  if (fileId !== null && state.status === "loading") {
    return (
      <span aria-busy="true" className="md-image-fallback" data-state="loading">
        {alt === "" ? null : <span className="md-image-alt">{alt}</span>}
      </span>
    );
  }

  return <ImageUnavailable alt={alt} />;
}

/** Defines the props of the file blob boundary. */
interface FileBlobBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

/** Defines the state of the file blob boundary. */
interface FileBlobBoundaryState {
  failed: boolean;
}

/**
 * Shows the fallback when the worker context is absent.
 * The image stays visible when the editor has no `WorkerProvider`.
 */
class FileBlobBoundary extends Component<
  FileBlobBoundaryProps,
  FileBlobBoundaryState
> {
  state: FileBlobBoundaryState = { failed: false };

  static getDerivedStateFromError(): FileBlobBoundaryState {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Shows one image and its selection state. */
function ImageNodeComponent({
  alt,
  nodeKey,
  src,
  title,
}: {
  alt: string;
  nodeKey: NodeKey;
  src: string;
  title: string;
}): ReactElement {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const resolveFile = useContext(ImageResolverContext);
  const fileId = readFileId(src);

  function handleClick(event: MouseEvent<HTMLSpanElement>): void {
    event.preventDefault();

    if (!isSelected) {
      clearSelection();
      setSelected(true);
    }

    editor.focus();
  }

  return (
    <span
      className="image-node-content"
      data-selected={isSelected ? "true" : undefined}
      onClick={handleClick}
    >
      <FileBlobBoundary fallback={<ImageUnavailable alt={alt} />}>
        <ImageContent
          alt={alt}
          fileId={fileId}
          resolveFile={resolveFile}
          title={title}
        />
      </FileBlobBoundary>
    </span>
  );
}

/** Defines one image node in the editor. */
export class ImageNode extends DecoratorNode<ReactElement> {
  __src: string;
  __alt: string;
  __title: string;

  constructor(src: string, alt: string, title: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__title = title;
  }

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__title, node.__key);
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      alt: serializedNode.alt,
      src: serializedNode.src,
      title: serializedNode.title,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      alt: this.__alt,
      src: this.__src,
      title: this.__title,
      type: this.getType(),
      version: 1,
    };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const wrapper = document.createElement("span");

    wrapper.className = "image-node";
    wrapper.contentEditable = "false";
    wrapper.dataset.slot = "image-node";

    return wrapper;
  }

  updateDOM(prevNode: ImageNode): boolean {
    return (
      prevNode.__src !== this.__src ||
      prevNode.__alt !== this.__alt ||
      prevNode.__title !== this.__title
    );
  }

  decorate(): ReactElement {
    return (
      <ImageNodeComponent
        alt={this.__alt}
        nodeKey={this.getKey()}
        src={this.__src}
        title={this.__title}
      />
    );
  }

  getTextContent(): string {
    return this.__alt;
  }

  isInline(): false {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAltText(): string {
    return this.getLatest().__alt;
  }

  getTitle(): string {
    return this.getLatest().__title;
  }
}

/** Creates one image node. */
export function $createImageNode({
  alt,
  src,
  title,
}: ImageNodeParams): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, alt, title));
}

/** Returns true when one node is an image node. */
export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}

import { createElement, Fragment, useMemo, type ReactNode } from "react";
import "./event-description.css";

const formatting = new Set(["p", "div", "span", "br", "strong", "b", "em", "i", "u", "s", "del", "ul", "ol", "li", "blockquote", "pre", "code"]);
const hidden = new Set(["script", "style", "template", "iframe", "object", "embed", "svg", "math"]);

function renderNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.localName;
  if (hidden.has(tag)) return null;
  const children = Array.from(element.childNodes, renderNode);
  if (tag === "a") {
    try {
      const url = new URL(element.getAttribute("href") ?? "");
      if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
        return <a key={key} href={url.href} target="_blank" rel="noopener noreferrer">{children}</a>;
      }
    } catch { /* Missing or invalid destinations remain readable text. */ }
  }
  if (tag === "br") return <br key={key} />;
  return createElement(formatting.has(tag) ? tag : Fragment, { key }, children);
}

export function EventDescription({ value }: { value: string }) {
  const html = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\s*\/?>/i.test(value);
  const content = useMemo(() => {
    if (!html) return value;
    // Parse inertly; rebuild only known React elements, never attach source HTML or attributes.
    const template = document.createElement("template");
    template.innerHTML = value;
    return Array.from(template.content.childNodes, renderNode);
  }, [value, html]);
  return <div className={`event-description${html ? "" : " event-description-plain"}`}>{content}</div>;
}

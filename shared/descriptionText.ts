export function descriptionText(description: string | null | undefined) {
  if (!description) return "";
  if (!/[<&]/.test(description)) return description.trim();

  // Template contents stay inert while we extract plain text from imported markup.
  const template = document.createElement("template");
  template.innerHTML = description;
  template.content
    .querySelectorAll("script, style, title, noscript, iframe, object, svg, math")
    .forEach((element) => element.remove());
  template.content
    .querySelectorAll(
      "br, div, p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th",
    )
    .forEach((element) => {
      element.before(" ");
      element.after(" ");
    });

  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

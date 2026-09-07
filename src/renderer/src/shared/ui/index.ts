// Components shared across windows. Mostly the framed windows (Settings,
// QuickValue) — WindowFrame, Layout, Form — but the launcher also pulls the
// `Footer` (results count / pin toggle / ⌘K actions menu) from here.
export { WindowFrame } from "./WindowFrame";
export { Breadcrumb } from "./Breadcrumb";
export { Layout } from "./Layout";
export { Footer } from "./Footer";
export type { ButtonProps, FooterMenuItem, FooterMenuProps } from "./Footer";
export { Form, useField } from "./Form";

import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import ListScreen from "./renderer/ListScreen";

export default [createScreen({ name: "group-list", component: ListScreen })];

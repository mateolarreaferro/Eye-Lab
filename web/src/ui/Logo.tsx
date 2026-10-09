import logo from "../assets/project-prakash-logo.svg";

/** The Project Prakash logo (from projectprakash.org's header): Eye Lab is made
 * for the Sinha lab's Project Prakash, and the user asked to show it. */
export function PrakashLogo({ height = 32 }: { height?: number }) {
  return <img src={logo} alt="Project Prakash" style={{ height, width: "auto" }} className="block" />;
}

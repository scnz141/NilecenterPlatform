import "@/styles/toasts.css";
import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Top centre on every route: staff sheets open from the inline-end edge, so
 * a corner toast would sit over their footer actions. Toasts hug their text,
 * so a stack stays expanded: a short pill folded over a long one would leave
 * the long one peeking out on both sides.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      expand
      className="toaster group"
      {...props}
    />
  );
};

export { Toaster };

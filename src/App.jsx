import { TooltipProvider } from "radix-ui/tooltip";
import "./App.css";
import Home from "./Pages/Home";
import { Toaster } from "sonner";

function App() {
  return (
    <>
      <TooltipProvider>
        <Toaster />
        <Home />
      </TooltipProvider>
    </>
  );
}

export default App;

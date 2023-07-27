import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppContextProvider from "./components/hooks/context";
import App from "./App";
import Gallery from "./Gallery";
const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <BrowserRouter>
  <AppContextProvider>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/gallery" element={<Gallery />} />
    </Routes>
  </AppContextProvider>
  </BrowserRouter>
);

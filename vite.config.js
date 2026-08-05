import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Replace YOUR-REPOSITORY-NAME with the exact GitHub repository name.
  base: "github.com/brianreyna03-dev/Tundra/",
});

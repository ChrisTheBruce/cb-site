/*
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
*/
//new
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
/*
  plugins: [react()],
  build: { outDir: "dist" }, // output goes to web/dist
  base: "/"
*/

  //new
   sourcemap: true,
   manifest: true,           // <-- critical: worker can resolve hashed filenames
   cssCodeSplit: true,
   rollupOptions: {
     output: {
       manualChunks: {
         react: ['react', 'react-dom'],
       },
      },
    },  
  },
})

import atImport from 'postcss-import';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
export default {
  plugins: [atImport(), tailwindcss(), autoprefixer()],
};

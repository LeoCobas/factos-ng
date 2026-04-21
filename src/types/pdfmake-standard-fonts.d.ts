declare module 'pdfmake/build/standard-fonts/Helvetica' {
  const fontContainer: {
    fonts: Record<string, unknown>;
    vfs?: Record<string, unknown>;
  };

  export default fontContainer;
}

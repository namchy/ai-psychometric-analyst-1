import localFont from "next/font/local";

export const plusJakartaSans = {
  className: "",
  variable: "",
};

export const zodiak = localFont({
  src: [
    {
      path: "../app/fonts/zodiak/Zodiak-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../app/fonts/zodiak/Zodiak-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-zodiak",
});

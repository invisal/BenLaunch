extern crate napi_build;

fn main() {
  napi_build::setup();
  println!("cargo:rustc-link-lib=framework=ApplicationServices");
  println!("cargo:rustc-link-lib=framework=CoreGraphics");
  println!("cargo:rustc-link-lib=framework=AppKit");
  // Text recognition (`recognize_png`).
  println!("cargo:rustc-link-lib=framework=Vision");
  println!("cargo:rustc-link-lib=dylib=objc");
}

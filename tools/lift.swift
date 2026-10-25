// 用 macOS Vision 主體去背：swift lift.swift in.png out.png
import Vision
import CoreImage
import AppKit
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1])
let ci = CIImage(contentsOf: url)!
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: ci)
try h.perform([req])
guard let r = req.results?.first else { print("no subject"); exit(1) }
let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: true)
let out = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
try ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: a[2]), format: .RGBA8, colorSpace: cs)
print("ok", r.allInstances.count)

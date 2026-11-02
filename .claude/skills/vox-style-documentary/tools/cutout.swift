// Free background removal on a Mac (macOS 14+, Apple Vision "lift subject"): swift cutout.swift IN.jpg OUT.png
// Keeps every detected foreground subject, crops to them, writes a transparent PNG. Exit 3 = no subject found.
import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: swift cutout.swift IN OUT.png"); exit(1) }
guard let input = CIImage(contentsOf: URL(fileURLWithPath: args[1]), options: [.applyOrientationProperty: true]) else { print("cannot read \(args[1])"); exit(2) }
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: input)
do {
  try handler.perform([request])
  guard let result = request.results?.first, !result.allInstances.isEmpty else { print("no subject found"); exit(3) }
  let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: true)
  let out = CIImage(cvPixelBuffer: buffer)
  try CIContext().writePNGRepresentation(of: out, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
  print("ok \(Int(out.extent.width))x\(Int(out.extent.height))")
} catch { print("vision error: \(error)"); exit(4) }

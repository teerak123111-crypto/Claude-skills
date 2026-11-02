// Face boxes with Apple Vision (free, macOS): swift face.swift A.jpg B.jpg ...
// prints one JSON line per image: {"f": path, "faces": [[cx, cy, w, h, confidence], ...]} in 0..1, origin top-left
import Foundation
import Vision
import CoreImage
for path in CommandLine.arguments.dropFirst() {
  var faces: [[Double]] = []
  if let img = CIImage(contentsOf: URL(fileURLWithPath: path)) {
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(ciImage: img).perform([req])
    for r in req.results ?? [] {
      let b = r.boundingBox
      faces.append([Double(b.midX), 1 - Double(b.midY), Double(b.width), Double(b.height), Double(r.confidence)])
    }
  }
  let d = try! JSONSerialization.data(withJSONObject: ["f": path, "faces": faces])
  print(String(data: d, encoding: .utf8)!)
}

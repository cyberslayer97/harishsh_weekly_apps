import { MOVENET_INPUT_SIZE, inputBufferFor, outputToArray, poseFromOutput, validateModel } from '../tensor'

const goodInput = { dataType: 'uint8', shape: [1, MOVENET_INPUT_SIZE, MOVENET_INPUT_SIZE, 3] }
const goodOutput = { dataType: 'float32', shape: [1, 1, 17, 3] }

describe('validateModel', () => {
  it('accepts the MoveNet layout', () => {
    expect(validateModel([goodInput], [goodOutput])).toBeNull()
  })

  it.each(['uint8', 'float32', 'int32'])('accepts %s input', (dataType) => {
    expect(validateModel([{ ...goodInput, dataType }], [goodOutput])).toBeNull()
  })

  it('rejects another input size', () => {
    expect(validateModel([{ ...goodInput, shape: [1, 256, 256, 3] }], [goodOutput])).toMatch(/Unexpected pose model input/)
  })

  it('rejects an input type we cannot feed', () => {
    expect(validateModel([{ ...goodInput, dataType: 'int8' }], [goodOutput])).toMatch(/not supported/)
  })

  it('rejects another output layout', () => {
    expect(validateModel([goodInput], [{ dataType: 'float32', shape: [1, 6, 56] }])).toMatch(/Unexpected pose model output/)
    expect(validateModel([goodInput], [{ dataType: 'uint8', shape: [1, 1, 17, 3] }])).toMatch(/Unexpected pose model output/)
  })

  it('rejects a model with no tensors', () => {
    expect(validateModel([], [])).toMatch(/no input or output/)
  })
})

describe('inputBufferFor', () => {
  const pixels = new Uint8Array([0, 128, 255, 7]).buffer

  it('passes uint8 through untouched', () => {
    expect(inputBufferFor(pixels, 'uint8')).toBe(pixels)
  })

  it('widens to float32 keeping the 0..255 values', () => {
    expect(Array.from(new Float32Array(inputBufferFor(pixels, 'float32')))).toEqual([0, 128, 255, 7])
  })

  it('widens to int32 keeping the 0..255 values', () => {
    expect(Array.from(new Int32Array(inputBufferFor(pixels, 'int32')))).toEqual([0, 128, 255, 7])
  })

  it('refuses a type it cannot make', () => {
    expect(() => inputBufferFor(pixels, 'int8')).toThrow(/Unsupported/)
  })
})

describe('outputs', () => {
  it('turns the model output into a plain array and then a pose', () => {
    const out = new Float32Array(51)
    out.set([0.25, 0.5, 0.75], 9 * 3) // left wrist: y, x, score
    const raw = outputToArray(out.buffer)
    expect(raw).toHaveLength(51)
    const pose = poseFromOutput(raw)
    expect(pose[9].y).toBeCloseTo(0.25)
    expect(pose[9].x).toBeCloseTo(0.5)
    expect(pose[9].score).toBeCloseTo(0.75)
  })
})

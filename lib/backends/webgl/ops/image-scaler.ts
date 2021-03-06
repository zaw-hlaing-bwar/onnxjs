// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import {ImageScaler} from '../../../ops/image-scaler';
import {Tensor} from '../../../tensor';
import {WebGLInferenceHandler} from '../inference-handler';
import {ProgramInfo} from '../program-info';
import {RunData} from '../program-manager';
import {WebGLOperator} from '../webgl-operator';
import {WebGLOperatorHelper} from '../webgl-operator-utils';

export class WebGLImageScaler extends ImageScaler implements WebGLOperator {
  run(inferenceHandler: WebGLInferenceHandler, inputs: Tensor[]): Tensor[] {
    return WebGLOperatorHelper.run(this, inferenceHandler, inputs);
  }
  createProgramInfo(handler: WebGLInferenceHandler, inputs: Tensor[]): ProgramInfo {
    const outputShape = inputs[0].dims.slice();
    const rank = outputShape.length;
    const getBiasMethod = this.createGetBiasMethod(this.bias.length);
    const shaderSource = `
      uniform sampler2D X;
      uniform float bias[${this.bias.length}];
      uniform float scale;
      ${getBiasMethod}
      float process(int indices[${rank}]) {
        return _X(indices) * scale + getBias(bias, indices[1]);
      }`;
    return {
      hasMain: false,
      inputLayouts: [handler.getOrCreateTextureLayout(inputs[0])],
      outputLayout: handler.createBasicTextureLayout(outputShape),
      shaderSource,
    };
  }
  createRunData(handler: WebGLInferenceHandler, programInfo: ProgramInfo, inputs: Tensor[]): RunData {
    const inputTDs = [handler.getOrCreate(inputs[0], programInfo.inputLayouts[0])];
    return {
      inputTextureDatas: inputTDs,
      outputTextureData: handler.createTextureDataFromLayout(programInfo.outputLayout, inputTDs[0].dataType),
      uniformData: {'bias': this.bias, 'scale': this.scale}
    };
  }
  private createGetBiasMethod(numChannels: number): string {
    const codeLines: string[] = [`float getBias(float bias[${numChannels}], int channel) {`];
    for (let i = 0; i < numChannels; ++i) {
      if (i === 0) {
        codeLines.push(
            `\t` +
            `if (channel == ${i}) { return bias[${i}]; }`);
      } else if (i === numChannels - 1) {
        codeLines.push(
            `\t` +
            `else { return bias[${i}]; }`);
      } else {
        codeLines.push(
            `\t` +
            `else if (channel == ${i}) { return bias[${i}]; }`);
      }
    }
    codeLines.push(
        `\t` +
        `}`);
    return codeLines.join('\n');
  }
}

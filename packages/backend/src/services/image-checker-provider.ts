/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import type {
  imageChecker,
  Disposable,
  ImageInfo,
  CancellationToken,
  ImageChecks,
  ImageCheck,
} from '@podman-desktop/api';
import type { AsyncInit } from '../utils/async-init';
import type { ContainerService } from './containers-service';
import type { ClairService } from './clair-service';

interface Dependencies {
  imageChecker: typeof imageChecker;
  clair: ClairService;
  containers: ContainerService;
}

export class ImageCheckerProvider implements Disposable, AsyncInit {
  #disposables: Array<Disposable> = [];

  constructor(private dependencies: Dependencies) {}

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
    this.#disposables = [];
  }
  protected async check(image: ImageInfo, _token?: CancellationToken): Promise<ImageChecks | undefined> {
    const vulnerabilities: Array<ImageCheck> = await this.dependencies.clair.analyse(image.engineId, image.Id);

    return {
      checks:
        vulnerabilities.length > 0
          ? vulnerabilities
          : [
              {
                status: 'success',
                name: 'No vulnerabilities found',
              },
            ],
    };
  }

  async init(): Promise<void> {
    this.#disposables.push(
      this.dependencies.imageChecker.registerImageCheckerProvider({
        check: this.check.bind(this),
      }),
    );
  }
}

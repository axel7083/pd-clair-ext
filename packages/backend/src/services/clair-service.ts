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

import type { containerEngine, ImageCheck } from '@podman-desktop/api';
import { ProgressLocation, CancellationTokenSource } from '@podman-desktop/api';
import type { BaseCliDependencies } from './cli-service';
import { CliService } from './cli-service';
import { join } from 'node:path';
import { mkdtempDisposable } from 'node:fs/promises';

interface Dependencies extends BaseCliDependencies {
  containers: typeof containerEngine;
}

export class ClairService extends CliService<Dependencies> {
  #update: CancellationTokenSource | undefined;

  override dispose(): void {
    super.dispose();
    // cancel / free potential pending update
    this.#update?.cancel();
    this.#update?.dispose();
    this.#update = undefined;
  }

  protected override get icon(): string {
    return 'icon.png';
  }
  protected get toolId(): string {
    return 'clair-action';
  }
  protected get displayName(): string {
    return 'Clair Action';
  }
  protected get markdownDescription(): string {
    return 'Clair vulnerability scanner';
  }
  protected get repoName(): string {
    return 'clair-action';
  }
  protected get orgName(): string {
    return 'axel7083';
  }

  public async report(engineId: string, imageId: string): Promise<void> {
    return this.dependencies.window.withProgress(
      {
        title: 'Clair - scanning image',
        cancellable: true,
        location: ProgressLocation.TASK_WIDGET,
      },
      async (progress, token) => {
        if (!this.cliTool?.path) throw new Error('clair-action is not installed.');

        await using dir = await mkdtempDisposable(engineId);
        const destination = join(dir.path, imageId);

        // save the image
        progress.report({
          message: `Saving ${imageId}`,
        });
        await this.dependencies.containers.saveImage(engineId, imageId, destination, token);

        // report
        const result = await this.dependencies.process.exec(
          this.cliTool?.path,
          ['report', '--image-path', destination, '--db-path', this.getDatabase()],
          {
            token,
          },
        );
      },
    );
  }

  public async update(): Promise<void> {
    if (this.#update) {
      throw new Error('an update is already pending');
    }

    const updateCancellationToken = new CancellationTokenSource();
    this.#update = updateCancellationToken;

    return this.dependencies.window
      .withProgress(
        {
          title: 'Clair database update',
          cancellable: true,
          location: ProgressLocation.TASK_WIDGET,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            updateCancellationToken.cancel();
          });

          if (!this.cliTool?.path) throw new Error('clair-action is not installed.');

          const start = performance.now();

          await this.dependencies.process.exec(this.cliTool?.path, ['update', '--db-path', this.getDatabase()], {
            token: updateCancellationToken.token,
          });

          const end = performance.now();

          progress.report({
            message: `Clair update completed in ${(end - start) / 1000}s`,
          });
        },
      )
      .finally(() => {
        this.#update?.dispose();
        this.#update = undefined;
      });
  }

  protected getDatabase(): string {
    return join(this.dependencies.storagePath, this.toolId, 'clair.sqlite');
  }

  public async analyse(_engineId: string, _imageId: string): Promise<Array<ImageCheck>> {
    return [];
  }
}

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
  Disposable,
  containerEngine,
  window,
  ProviderContainerConnection,
  navigation,
  TelemetryLogger,
} from '@podman-desktop/api';
import type { ProviderService } from './provider-service';
import type { AsyncInit } from '../utils/async-init';
import type { SimpleImageInfo } from '../models/simple-image-info';
import type { ProviderContainerConnectionIdentifierInfo } from '../models/provider-container-connection-identifier-info';

interface Dependencies {
  containers: typeof containerEngine;
  windowApi: typeof window;
  providers: ProviderService;
  navigation: typeof navigation;
  telemetry: TelemetryLogger;
}

export class ImageService implements AsyncInit, Disposable {
  #disposables: Disposable[] = [];

  constructor(protected readonly dependencies: Dependencies) {}

  public async all(options: {
    registry: string;
    connection: ProviderContainerConnection;
    organisation: string;
  }): Promise<Array<SimpleImageInfo>> {
    const images = await this.dependencies.containers.listImages({
      provider: options.connection.connection,
    });

    const connection: ProviderContainerConnectionIdentifierInfo = {
      providerId: options.connection.providerId,
      name: options.connection.connection.name,
    };

    return images.reduce((accumulator, current) => {
      const tag = current.RepoTags?.find(tag => tag.startsWith(`${options.registry}/${options.organisation}`));
      if (tag) {
        accumulator.push({
          id: current.Id,
          name: tag,
          connection,
        });
      }
      return accumulator;
    }, [] as Array<SimpleImageInfo>);
  }

  public async inspect(options: {
    imageId: string;
    connection: ProviderContainerConnection;
  }): Promise<SimpleImageInfo> {
    const engineId = await this.getEngineId(options.connection);
    const image = await this.dependencies.containers.getImageInspect(engineId, options.imageId);
    return {
      id: image.Id,
      name: image.RepoTags?.[0] ?? '<none>',
      connection: this.dependencies.providers.toProviderContainerConnectionDetailedInfo(options.connection),
    };
  }

  protected async getEngineId(connection: ProviderContainerConnection): Promise<string> {
    const info = await this.dependencies.containers.listInfos({
      provider: connection.connection,
    });
    if (info.length !== 1) throw new Error('Unexpected number of connections');
    return info[0].engineId;
  }

  public async navigateToImageDetails(image: SimpleImageInfo): Promise<void> {
    const connection = this.dependencies.providers.getProviderContainerConnection(image.connection);
    const engineId = await this.getEngineId(connection);

    return this.dependencies.navigation.navigateToImage(image.id, engineId, image.name);
  }

  dispose(): void {
    this.#disposables.forEach((disposable: Disposable) => disposable.dispose());
  }

  async init(): Promise<void> {}
}

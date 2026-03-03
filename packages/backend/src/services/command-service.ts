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
import type { commands as commandsApi, Disposable, ProviderContainerConnection } from '@podman-desktop/api';
import type { RoutingService } from './routing-service';
import type { AsyncInit } from '../utils/async-init';
import { z } from 'zod';
import type { ContainerService } from './containers-service';
import type { ProviderService } from './provider-service';

interface Dependencies {
  commandsApi: typeof commandsApi;
  routing: RoutingService;
  containers: ContainerService;
  providers: ProviderService;
}

const ImageInfoUISchema = z.object({
  id: z.string(),
  engineId: z.string(),
  arch: z.string(),
  isManifest: z.boolean(),
});

export class CommandService implements Disposable, AsyncInit {
  #disposables: Disposable[] = [];

  constructor(private dependencies: Dependencies) {}

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  async init(): Promise<void> {
    this.#disposables.push(
      this.dependencies.commandsApi.registerCommand('syft.analysis', this.syftAnalysis.bind(this)),
    );
  }

  protected async syftAnalysis(args: unknown): Promise<void> {
    const result = ImageInfoUISchema.safeParse(args);
    if (!result.success) {
      console.error('[syftAnalysis]', args, result.error);
      throw result.error;
    }

    const { engineId, id } = result.data;

    // 1. Get the {@link ProviderContainerConnection} by engine id
    const provider: ProviderContainerConnection =
      await this.dependencies.containers.getRunningProviderContainerConnectionByEngineId(engineId);
    // 2. Transform the ProviderContainerConnection in ProviderContainerConnectionDetailedInfo
    const providerIdentifier = this.dependencies.providers.toProviderContainerConnectionDetailedInfo(provider);
    // 3. Redirect to the image analysis page
    return this.dependencies.routing.openImageAnalysisPage(providerIdentifier, id);
  }
}

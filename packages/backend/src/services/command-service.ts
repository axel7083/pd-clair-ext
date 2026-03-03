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
import type { commands as commandsApi, Disposable } from '@podman-desktop/api';
import type { AsyncInit } from '../utils/async-init';
import type { ContainerService } from './containers-service';
import type { ProviderService } from './provider-service';
import type { ClairService } from './clair-service';

interface Dependencies {
  commandsApi: typeof commandsApi;
  containers: ContainerService;
  providers: ProviderService;
  clair: ClairService;
}

export class CommandService implements Disposable, AsyncInit {
  #disposables: Disposable[] = [];

  constructor(private dependencies: Dependencies) {}

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  async init(): Promise<void> {
    this.#disposables.push(
      this.dependencies.commandsApi.registerCommand(
        'clair.update',
        this.dependencies.clair.update.bind(this.dependencies.clair),
      ),
    );
  }
}

/*
 * @file         : info.ts
 * @summary      : video info command
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : displays information about a video
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 05 Jul 2021
 * @license:     : MIT
 *
 * Copyright 2021 Benjamin Maggi <benjaminmaggi@gmail.com>
 *
 *
 * License:
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as ytsr from 'ytsr';
import { JsonArray, ensureString } from '@salesforce/ts-types';
import * as utils from '../utils/utils';
import { YtKitCommand, YtKitResult } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';

export default class Search extends YtKitCommand {
  public static id = 'search';
  public static readonly description = 'Search for Youtube for Videos';
  public static readonly examples = ['$ ytdl search -q banana'];
  public static readonly result: YtKitResult = {
    tableColumnData: ['title', 'author', 'views', 'publish date', 'length', 'id'],
  };

  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      description: 'Query term',
      required: true,
    }),
    limit: flags.string({
      char: 'l',
      description: 'Limits the pulled items, defaults to 100, set to Infinity to get the whole list of search results',
      default: '100',
    }),
    'safe-search': flags.boolean({
      description: 'Pull items in youtube restriction mode',
      default: false,
    }),
    options: flags.boolean({
      char: 'o',
      description: 'Search options',
    }),
  };

  protected searchString!: string;
  protected searchOptions!: ytsr.Options;
  protected request!: ytsr.Result;
  protected filters!: Map<string, Map<string, ytsr.Filter>>;
  protected tableColumnData = [
    'title',
    'author:{author.name}',
    'views',
    'publish date:{uploadedAt}',
    'length:{duration}',
    'id',
  ];

  public async run(): Promise<JsonArray | undefined> {
    this.searchOptions = this.getSearchOptions();
    this.filters = await this.getFilters(this.flags.query);
    const url = ensureString(this.filters.get('Type')?.get('Video')?.url);
    this.request = await this.search(url, this.searchOptions);
    return this.getRows();
  }

  private getSearchOptions(): ytsr.Options {
    return {
      limit: parseFloat(this.flags.limit),
      safeSearch: Boolean(this.flags['safe-search']),
    } as ytsr.Options;
  }

  private getRows(): Array<Record<string, string>> {
    return this.request.items.map((item: ytsr.Item) => {
      return this.tableColumnData.reduce((column, current) => {
        const [label, template] = current.split(':');
        if (template) {
          const value = template.replace(/\{([\w.-]+)\}/g, (match: string, prop: string) => {
            return utils.getValueFrom<string>(item, prop);
          });
          return {
            ...column,
            [label]: value,
          };
        }
        return {
          ...column,
          [label]: utils.getValueFrom<string>(item, label),
        };
      }, {});
    });
  }

  private async getFilters(
    searchString: string,
    options?: ytsr.ShortOptions
  ): Promise<Map<string, Map<string, ytsr.Filter>>> {
    return await ytsr.getFilters(searchString, options);
  }

  private async search(searchString: string, options?: ytsr.Options): Promise<ytsr.Result> {
    return await ytsr(searchString, options);
  }
}

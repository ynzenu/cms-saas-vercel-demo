import { Utils } from '@remkoj/optimizely-cms-react'
import { createClient, type IOptiGraphClient } from '@remkoj/optimizely-graph-client'
import * as GraphQL from '@gql/graphql';
import { getSdk } from "@gql/client";
import { getFragmentData } from '@gql/fragment-masking';
import type * as Types from './types';
import 'server-only'

export async function getArticles(locale: string, paging?: Types.PagingData, filters?: Types.Filters, client?: IOptiGraphClient) : Promise<Types.GetArticlesResult>
{
    const graphClient = client ?? createClient(undefined, undefined, {
        nextJsFetchDirectives: true,
        cache: true,
        queryCache: true,
    });
    const sdk = getSdk(graphClient);
    const pageSize = paging?.count ?? 10
    const pageNumber = paging?.page ?? 1
    const published : string | undefined = filters?.published
    const publishedEnd = !published ? undefined : (() => { const d = new Date(published); d.setDate(d.getDate() +1); return d.toISOString()})()
    const result = await sdk.getArticles({
        locale: locale as GraphQL.Locales,
        pageSize: paging?.count ?? 10,
        start: pageSize * (pageNumber - 1),
        author: filters?.author,
        published,
        publishedEnd
    })

    const articleResponse = result.getArticles
    if (!articleResponse)
        throw new Error("No data in the response")

    const totalResults = articleResponse.total ?? 0
    const totalPages = Math.ceil(totalResults / pageSize)

    return {
        locale,
        totalResults,
        totalPages,
        pageSize,
        pageNumber,
        facets: {
            author: (articleResponse.facets?.author ?? []).filter(Utils.isNotNullOrUndefined).map(x => {return { name: x.name ?? "", count: x.count ?? 0}}),
            published: (articleResponse.facets?._metadata?.published ?? []).filter(Utils.isNotNullOrUndefined).map(x => { return { date: x.name ?? "", count: x.count ?? 0}})
        },
        items: (articleResponse.items ?? []).filter(Utils.isNotNullOrUndefined).map(item => {
            const iContentData = getFragmentData(GraphQL.IContentDataFragmentDoc, item)
            const metadata = getFragmentData(GraphQL.IContentInfoFragmentDoc, iContentData._metadata)
            const imageUrlData = getFragmentData(GraphQL.LinkDataFragmentDoc, getFragmentData(GraphQL.ReferenceDataFragmentDoc, item.image)?.url)
            const imageUrl = imageUrlData ? new URL(imageUrlData?.default ?? '/', imageUrlData?.base ?? 'https://example.com').href : undefined
            const itemUrlData = getFragmentData(GraphQL.LinkDataFragmentDoc, metadata?.url)
            const itemUrl = itemUrlData ? new URL(itemUrlData?.default ?? '/', itemUrlData?.base ?? 'https://example.com') : undefined
            return {
                id: metadata?.key ?? "",
                name: metadata?.displayName ?? "",
                title: item.title ?? "",
                description: item.description?.text ?? "",
                author: item.author ?? "",  
                published: item._metadata?.published ?? "2000-01-01T00:00:00Z",
                image: {
                    src: imageUrl ?? null
                },
                path: itemUrl?.pathname ?? null,
                url: itemUrl?.href ?? null
            }
        })
    }
}

export type * as Types from './types'
export default getArticles
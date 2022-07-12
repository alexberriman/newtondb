# Roadmap

This document describes the current status of upcoming features and milestones.

## Key

| Status      | Indicator |
| ----------- | --------- |
| Done        | ✅        |
| In Progress | 🚀        |
| No Movement | ❌        |

## Summary

#### Milestone Summary

| Status | Milestone                 | Goals |
| :----: | :------------------------ | :---: |
|   ❌   | **[Indexing](#indexing)** | 0 / 2 |
|   ❌   | **[Adapters](#adapters)** | 0 / 1 |

## Indexing

#### Milestone Summary

| Status | Milestone                                   | Goals |
| :----: | :------------------------------------------ | :---: |
|   ❌   | **[Sort keys](#sort-keys)**                 | 0 / 1 |
|   ❌   | **[Secondary indexes](#secondary-indexes)** | 0 / 1 |

### Sort keys

Will improve performance on read operations. Records that are stored pre-sorted can be returned a lot more efficiently as opposed to sorting the entire linked list each query.

🚀 &nbsp;**OPEN** &nbsp;&nbsp;📉 &nbsp;&nbsp;**0 / 1** goals completed **(0%)**

| Status | Goal                                                          | Labels                   |
| :----: | :------------------------------------------------------------ | ------------------------ |
|   ❌   | [Sort keys](https://github.com/alexberriman/cleardb/issues/2) | `enhancement`, `backlog` |

### Secondary indexes

Currently, an index is only created for the primary key of a collection. That means for every other query where the primary key is not included, the entire collection has to be scanned. If you were able to configure multiple secondary indexes, read operations could reference the hash table as opposed to scanning the linked list.

🚀 &nbsp;**OPEN** &nbsp;&nbsp;📉 &nbsp;&nbsp;**0 / 1** goals completed **(0%)**

| Status | Goal                                                                  | Labels                   |
| :----: | :-------------------------------------------------------------------- | ------------------------ |
|   ❌   | [Secondary indexes](https://github.com/alexberriman/cleardb/issues/3) | `enhancement`, `backlog` |

## Adapters

#### Milestone Summary

| Status | Milestone             | Goals |
| :----: | :-------------------- | :---: |
|   ❌   | **[S3 adapter](#s3)** | 0 / 1 |

### S3

Read/write a JSON file from Amazon's S3 object storage. This will most likely be released in a separate package not part of the core.

🚀 &nbsp;**OPEN** &nbsp;&nbsp;📉 &nbsp;&nbsp;**0 / 1** goals completed **(0%)**

| Status | Goal                                                           | Labels                   |
| :----: | :------------------------------------------------------------- | ------------------------ |
|   ❌   | [S3 adapter](https://github.com/alexberriman/cleardb/issues/3) | `enhancement`, `backlog` |

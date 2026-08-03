"""DynamoDB access helpers."""


def scan_all(table, **kwargs) -> list:
    """Return every item from a table scan, following pagination.

    A single ``table.scan()`` returns at most 1 MB of data and a
    ``LastEvaluatedKey`` when more remains. Reading only the first page (the
    common ``.scan().get("Items")`` pattern) silently drops items once a table
    grows past that limit -- recipes vanish from lists, and a user whose record
    falls on a later page can't be found at login. This loops until the scan is
    exhausted. Extra kwargs (e.g. ``FilterExpression``, ``ProjectionExpression``)
    are forwarded to each page.
    """
    items = []
    response = table.scan(**kwargs)
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"], **kwargs)
        items.extend(response.get("Items", []))
    return items
